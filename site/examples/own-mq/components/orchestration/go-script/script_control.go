// Package scriptcontrol models the control-plane state machine only.
// No host exec, network listener, sandbox implementation or durable store is provided.
// now is trusted authority time; never pass an untrusted client timestamp here.
package scriptcontrol

import (
 "errors"
 "math"
 "regexp"
 "sync"
)

type Key struct { Tenant, Request string }
type Input struct { Key Key; ScriptSHA string; Deadline int64 }
type Job struct { Input Input; State, Owner, Output string; Epoch uint64; LeaseUntil int64 }
type Store struct { mu sync.Mutex; jobs map[Key]Job; capacity int }
var identifier = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var digest = regexp.MustCompile(`^[a-f0-9]{64}$`)
var ErrConflict = errors.New("conflict")
var ErrState = errors.New("invalid or stale state")

func New(capacity int) *Store {
 if capacity <= 0 { panic("positive capacity required") }
 return &Store{jobs: make(map[Key]Job), capacity: capacity}
}
// Authentication and artifact ownership checks belong to the caller before Submit.
func (s *Store) Submit(in Input, now int64) (Job, error) {
 if !identifier.MatchString(in.Key.Tenant) || !identifier.MatchString(in.Key.Request) || !digest.MatchString(in.ScriptSHA) || now < 0 || in.Deadline <= 0 {
  return Job{}, ErrState
 }
 s.mu.Lock(); defer s.mu.Unlock()
 if old, ok := s.jobs[in.Key]; ok {
  if old.Input != in { return Job{}, ErrConflict }; return old, nil
 }
 if in.Deadline <= now { return Job{}, ErrState }
 if len(s.jobs) >= s.capacity { return Job{}, errors.New("capacity") }
 j := Job{Input: in, State:"QUEUED"}; s.jobs[in.Key] = j; return j, nil
}
// The production implementation must commit this CAS/lease in shared durable storage.
func (s *Store) Claim(key Key, owner string, now, ttl int64) (Job, error) {
 if !identifier.MatchString(owner) || now < 0 || ttl <= 0 || ttl > math.MaxInt64-now { return Job{}, ErrState }
 s.mu.Lock(); defer s.mu.Unlock()
 j, ok := s.jobs[key]
 if !ok || j.State != "QUEUED" || now >= j.Input.Deadline || j.Epoch == math.MaxUint64 { return Job{}, ErrState }
 j.Epoch++; j.State="RUNNING"; j.Owner=owner; j.LeaseUntil=now+ttl
 if j.LeaseUntil>j.Input.Deadline { j.LeaseUntil=j.Input.Deadline }
 s.jobs[key]=j; return j,nil
}
func (s *Store) Complete(key Key, owner string, epoch uint64, now int64, output string) (Job,error) {
 if now<0 || len(output)>4096 { return Job{},ErrState }
 s.mu.Lock(); defer s.mu.Unlock()
 j,ok:=s.jobs[key]
 if !ok || j.Owner!=owner || j.Epoch!=epoch { return Job{},ErrState }
 if j.State=="SUCCEEDED" { if j.Output!=output { return Job{},ErrConflict };return j,nil }
 if j.State!="RUNNING" || now>=j.LeaseUntil {return Job{},ErrState}
 j.State="SUCCEEDED";j.Output=output;s.jobs[key]=j;return j,nil
}
// Expiry never blindly reruns a script whose external effects may already have happened.
func (s *Store) Expire(now int64) error {
 if now<0 {return ErrState};s.mu.Lock();defer s.mu.Unlock()
 for key,j:=range s.jobs {if j.State=="RUNNING" && now>=j.LeaseUntil {j.State="UNKNOWN";s.jobs[key]=j}}
 return nil
}
func (s *Store) Cancel(key Key) (Job,error) {
 s.mu.Lock();defer s.mu.Unlock();j,ok:=s.jobs[key];if !ok{return Job{},ErrState}
 switch j.State {case "QUEUED":j.State="CANCELLED";case "RUNNING","UNKNOWN":j.State="CANCEL_REQUESTED";case "CANCELLED","CANCEL_REQUESTED":return j,nil;default:return Job{},ErrState}
 s.jobs[key]=j;return j,nil
}
// Trusted reconciler calls this only after authenticated sandbox status/receipt verification.
// NOT_STARTED includes proof that the old sandbox cannot later execute. A timeout is not proof.
func (s *Store) Reconcile(key Key, epoch uint64, decision, output string, now int64) (Job,error) {
 if now<0 || len(output)>4096 {return Job{},ErrState};s.mu.Lock();defer s.mu.Unlock()
 j,ok:=s.jobs[key];if !ok || j.Epoch!=epoch || (j.State!="UNKNOWN" && j.State!="CANCEL_REQUESTED") {return Job{},ErrState}
 switch decision {
 case "NOT_STARTED":
  if j.State=="CANCEL_REQUESTED" {j.State="CANCELLED"} else if now>=j.Input.Deadline {j.State="FAILED"} else {j.State="QUEUED"}
 case "SUCCEEDED":j.State="SUCCEEDED";j.Output=output
 case "FAILED":j.State="FAILED";j.Output=output
 default:return Job{},ErrState
 }
 s.jobs[key]=j;return j,nil
}
func (s *Store) Get(key Key) (Job,bool) {s.mu.Lock();defer s.mu.Unlock();j,ok:=s.jobs[key];return j,ok}
