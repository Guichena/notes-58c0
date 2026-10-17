package handbook;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.servlet.http.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

public class MvcLab {
    record Sum(long result){}
    record Input(@NotNull Integer a,@NotNull Integer b){}
    @RestController @RequestMapping("/api")
    public static class Calculator {
        @GetMapping("/sum") public Sum sum(@RequestParam("a")int a,@RequestParam("b")int b){return new Sum((long)a+b);}
        @PostMapping("/sum") public Sum sumBody(@Valid @RequestBody Input input){return new Sum((long)input.a()+input.b());}
        @GetMapping("/failure") public Sum fail(){throw new IllegalStateException("private diagnostic");}
    }
    @RestControllerAdvice public static class Errors {
        @ExceptionHandler(MethodArgumentNotValidException.class)
        ResponseEntity<ProblemDetail> validation(){return ResponseEntity.badRequest().body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"a and b are required"));}
        @ExceptionHandler(IllegalStateException.class)
        ResponseEntity<ProblemDetail> failure(){return ResponseEntity.internalServerError().body(ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,"operation failed"));}
    }
    static void expect(MockMvc mvc,org.springframework.test.web.servlet.RequestBuilder request,int status,String body)throws Exception{
        var response=mvc.perform(request).andReturn().getResponse();
        if(response.getStatus()!=status||!response.getContentAsString().contains(body))throw new AssertionError(response.getStatus()+" "+response.getContentAsString());
    }
    public static void main(String[] args)throws Exception{
        List<String> trace=new ArrayList<>();
        HandlerInterceptor interceptor=new HandlerInterceptor(){
            public boolean preHandle(HttpServletRequest q,HttpServletResponse s,Object h)throws Exception{
                trace.add("pre");if("yes".equals(q.getHeader("X-Deny"))){s.setStatus(403);return false;}return true;
            }
            public void postHandle(HttpServletRequest q,HttpServletResponse s,Object h,org.springframework.web.servlet.ModelAndView m){trace.add("post");}
            public void afterCompletion(HttpServletRequest q,HttpServletResponse s,Object h,Exception e){trace.add("complete");}
        };
        try(var validator=new LocalValidatorFactoryBean()){
            validator.afterPropertiesSet();
            MockMvc mvc=MockMvcBuilders.standaloneSetup(new Calculator()).setControllerAdvice(new Errors()).setValidator(validator).addInterceptors(interceptor).build();
            expect(mvc,get("/api/sum").param("a","2147483647").param("b","1"),200,"2147483648");
            if(!trace.equals(List.of("pre","post","complete")))throw new AssertionError(trace);trace.clear();
            expect(mvc,get("/api/sum").param("a","bad").param("b","1"),400,"");trace.clear();
            expect(mvc,get("/api/sum").param("a","1"),400,"");trace.clear();
            expect(mvc,post("/api/sum").contentType(MediaType.APPLICATION_JSON).content("{\"a\":1,\"b\":2}"),200,"3");trace.clear();
            expect(mvc,post("/api/sum").contentType(MediaType.APPLICATION_JSON).content("{\"a\":1}"),400,"required");trace.clear();
            expect(mvc,get("/api/failure"),500,"operation failed");
            if(!trace.equals(List.of("pre","complete")))throw new AssertionError(trace);trace.clear();
            expect(mvc,get("/api/sum").header("X-Deny","yes"),403,"");
            if(!trace.equals(List.of("pre")))throw new AssertionError(trace);
        }
        System.out.println("PASS 7 MockMvc parameter, validation, exception and interceptor scenarios");
    }
}
