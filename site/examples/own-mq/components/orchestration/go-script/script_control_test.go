package scriptcontrol
import("strings";"sync";"sync/atomic";"testing")
func sample() Input{return Input{Key:Key{"tenant","request"},ScriptSHA:strings.Repeat("a",64),Deadline:100}}
func TestControl(t *testing.T){
 s:=New(10);in:=sample();if _,e:=s.Submit(in,0);e!=nil{t.Fatal(e)}
 if _,e:=s.Submit(in,0);e!=nil{t.Fatal(e)}
 if _,e:=s.Submit(in,100);e!=nil{t.Fatal("existing request replay after deadline",e)}
 changed:=in;changed.ScriptSHA=strings.Repeat("b",64);if _,e:=s.Submit(changed,0);e!=ErrConflict{t.Fatal("missing conflict")}
 var n atomic.Int32;var wg sync.WaitGroup
 for i:=0;i<30;i++{wg.Add(1);go func(){defer wg.Done();if _,e:=s.Claim(in.Key,"worker",0,10);e==nil{n.Add(1)}}()};wg.Wait()
 if n.Load()!=1{t.Fatal("one owner required")};j,_:=s.Get(in.Key)
 if _,e:=s.Complete(in.Key,"wrong",j.Epoch,1,"x");e==nil{t.Fatal("wrong owner")}
 if e:=s.Expire(10);e!=nil{t.Fatal(e)}
 if _,e:=s.Claim(in.Key,"other",10,10);e==nil{t.Fatal("unknown must not rerun")}
 if _,e:=s.Complete(in.Key,"worker",j.Epoch,10,"x");e==nil{t.Fatal("expired result")}
 if _,e:=s.Reconcile(in.Key,j.Epoch,"NOT_STARTED","",10);e!=nil{t.Fatal(e)}
 next,e:=s.Claim(in.Key,"new",10,10);if e!=nil||next.Epoch!=j.Epoch+1{t.Fatal("new epoch",e)}
 if _,e=s.Complete(in.Key,"worker",j.Epoch,11,"x");e==nil{t.Fatal("old owner")}
 if _,e=s.Complete(in.Key,"new",next.Epoch,11,"ok");e!=nil{t.Fatal(e)}
 if _,e=s.Complete(in.Key,"new",next.Epoch,12,"ok");e!=nil{t.Fatal("receipt replay",e)}
 if _,e=s.Complete(in.Key,"new",next.Epoch,12,"different");e!=ErrConflict{t.Fatal("receipt conflict")}
}
func TestCancelAndBounds(t *testing.T){
 s:=New(1);in:=sample();s.Submit(in,0);j,_:=s.Claim(in.Key,"worker",0,10)
 x,e:=s.Cancel(in.Key);if e!=nil||x.State!="CANCEL_REQUESTED"{t.Fatal("cancel request")}
 if _,e=s.Complete(in.Key,"worker",j.Epoch,1,"x");e==nil{t.Fatal("requires reconciliation")}
 x,e=s.Reconcile(in.Key,j.Epoch,"SUCCEEDED","committed",2);if e!=nil||x.State!="SUCCEEDED"{t.Fatal("cancel not undo")}
 other:=in;other.Key.Request="other";if _,e=s.Submit(other,0);e==nil{t.Fatal("capacity")}
 s2:=New(1);s2.Submit(in,0);x,e=s2.Cancel(in.Key);if e!=nil||x.State!="CANCELLED"{t.Fatal("queued cancel")}
 if _,e=s2.Claim(in.Key,"w",100,10);e==nil{t.Fatal("deadline")}
 if _,e=s2.Submit(in,-1);e==nil{t.Fatal("time")}
}
