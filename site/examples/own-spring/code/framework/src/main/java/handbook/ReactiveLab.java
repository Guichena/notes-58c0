package handbook;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import reactor.core.publisher.*;
import reactor.test.StepVerifier;

public class ReactiveLab {
    public static void main(String[] args){
        StepVerifier.create(Flux.range(1,3),0).thenRequest(1).expectNext(1).thenRequest(2).expectNext(2,3).verifyComplete();
        StepVerifier.create(Mono.deferContextual(c->Mono.just("tenant:"+c.get("tenant"))).contextWrite(c->c.put("tenant","A")))
                .expectNext("tenant:A").verifyComplete();
        AtomicBoolean cancelled=new AtomicBoolean();
        StepVerifier.create(Flux.<String>never().doOnCancel(()->cancelled.set(true))).thenCancel().verify();
        if(!cancelled.get())throw new AssertionError();
        StepVerifier.withVirtualTime(()->Mono.<String>never().timeout(Duration.ofSeconds(2)))
                .thenAwait(Duration.ofSeconds(2)).expectError(java.util.concurrent.TimeoutException.class).verify();
        StepVerifier.create(Mono.error(new IllegalArgumentException("bad input")))
                .expectError(IllegalArgumentException.class).verify();
        System.out.println("PASS reactive demand, Context, cancellation, timeout and error signals");
    }
}
