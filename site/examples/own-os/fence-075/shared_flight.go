// Requires golang.org/x/sync/singleflight.
// Waiter cancellation is separate from the shared work lifetime.
package sharedflight

import (
    "context"
    "errors"
    "time"
    "golang.org/x/sync/singleflight"
)

type Loader struct { Group singleflight.Group }

// waitCtx is one caller's patience; serviceCtx owns the shared work lifecycle.
// key must include every result/authorization-relevant dimension.
// fetch must obey its context; no API here force-kills a goroutine.
func (l *Loader) Load(waitCtx, serviceCtx context.Context, key string,
    workLimit time.Duration, fetch func(context.Context) (string, error)) (string, error) {
    if err := waitCtx.Err(); err != nil { return "", err }
    if workLimit <= 0 { return "", errors.New("work limit must be positive") }
    ch := l.Group.DoChan(key, func() (any, error) {
        workCtx, cancel := context.WithTimeout(serviceCtx, workLimit)
        defer cancel()
        return fetch(workCtx)
    })
    select {
    case <-waitCtx.Done(): return "", waitCtx.Err()
    case r := <-ch:
        if r.Err != nil { return "", r.Err }
        v, ok := r.Val.(string)
        if !ok { return "", errors.New("unexpected shared result type") }
        return v, nil
    }
}

