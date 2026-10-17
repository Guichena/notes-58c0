package handbook;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.*;

public class AutoConfigurationLab {
    record Greeting(String text){}
    @AutoConfiguration
    @ConditionalOnClass(name="java.time.Clock")
    @ConditionalOnProperty(prefix="demo.greeting",name="enabled",havingValue="true",matchIfMissing=false)
    static class GreetingAutoConfiguration {
        @Bean @ConditionalOnMissingBean Greeting greeting(){return new Greeting("automatic");}
    }
    @Configuration(proxyBeanMethods=false) static class UserConfig{
        @Bean Greeting greeting(){return new Greeting("user-defined");}
    }
    public static void main(String[] args){
        var runner=new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(GreetingAutoConfiguration.class));
        runner.run(c->{if(c.containsBean("greeting"))throw new AssertionError();});
        runner.withPropertyValues("demo.greeting.enabled=true").run(c->{if(!c.getBean(Greeting.class).text().equals("automatic"))throw new AssertionError();});
        runner.withPropertyValues("demo.greeting.enabled=true").withUserConfiguration(UserConfig.class).run(c->{if(!c.getBean(Greeting.class).text().equals("user-defined"))throw new AssertionError();});
        System.out.println("PASS condition disabled, enabled, user-bean backoff");
    }
}
