import java.util.*;
public final class InitializationOrder {
    static final List<String> events=new ArrayList<>();
    static int mark(String message) { events.add(message);return 7; }
    static class Parent { static int value=mark("Parent.static"); }
    static class Child extends Parent {
        static final int CONSTANT=11;
        static int childValue=mark("Child.static");
        int field=mark("Child.field");
        Child() { events.add("Child.constructor"); }
    }
    public static void main(String[] args) throws Exception {
        Child[] array=new Child[2];
        Class.forName(Child.class.getName(),false,Child.class.getClassLoader());
        if(Child.CONSTANT!=11 || !events.isEmpty() || array.length!=2) throw new AssertionError(events);
        if(Child.value!=7 || !events.equals(List.of("Parent.static"))) throw new AssertionError(events);
        Child child=new Child();
        if(child.field!=7 || !events.equals(List.of("Parent.static","Child.static","Child.field","Child.constructor"))) throw new AssertionError(events);
        System.out.println("PASS: "+events+"; arrays/constants/noninitializing lookup did not initialize Child");
    }
}
