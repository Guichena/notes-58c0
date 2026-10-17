import java.util.*;
import java.util.stream.*;
import java.util.function.*;
public class ApiBoundaries {
 static int checks=0;
 static void ok(boolean b){checks++;if(!b)throw new AssertionError(checks);}
 static void fails(Class<? extends Throwable> type,Runnable f){try{f.run();throw new AssertionError("missing exception");}catch(Throwable t){ok(type.isInstance(t));}}
 record User(Long id,String name){Long getId(){return id;}String getName(){return name;}}
 record Employee(String department,int salary){String getDepartment(){return department;}int getSalary(){return salary;}}
 public static void main(String[] args){
 Integer[] nums={Integer.MIN_VALUE,0,Integer.MAX_VALUE};Arrays.sort(nums,(a,b)->Integer.compare(b,a));ok(nums[0]==Integer.MAX_VALUE&&nums[2]==Integer.MIN_VALUE);
 Map<String,Integer> m=new HashMap<>();m.put("x",null);ok(m.getOrDefault("x",0)==null);ok(m.getOrDefault("missing",0)==0);
 List<String> list=Stream.of("a","b").toList();fails(UnsupportedOperationException.class,()->list.add("c"));List<String> mutable=Stream.of("a").collect(Collectors.toCollection(ArrayList::new));mutable.add("b");ok(mutable.size()==2);
 List<List<String>> groups=List.of(List.of("A","B"),List.of("C"));ok(groups.stream().map(List::stream).count()==2);ok(groups.stream().flatMap(List::stream).toList().equals(List.of("A","B","C")));
 ok(Stream.<String>empty().allMatch(x->false));ok(Stream.<String>empty().noneMatch(x->true));ok(!Stream.<String>empty().anyMatch(x->true));
 ok(Arrays.stream(new int[]{1,2}).count()==2);ok(Stream.of(new int[]{1,2}).count()==1);
 List<User> users=List.of(new User(1L,"Alice"),new User(1L,"Bob"),new User(2L,"Charlie"));Map<Long,User> map=users.stream().collect(Collectors.toMap(User::getId,Function.identity(),(v1,v2)->v1));ok(map.get(1L).getName().equals("Alice"));fails(IllegalStateException.class,()->users.stream().collect(Collectors.toMap(User::getId,Function.identity())));ok(users.stream().map(User::getName).collect(Collectors.joining(", ")).equals("Alice, Bob, Charlie"));
 List<Employee> employees=List.of(new Employee("eng",Integer.MAX_VALUE),new Employee("eng",1));ok(employees.stream().collect(Collectors.groupingBy(Employee::getDepartment,Collectors.summingInt(Employee::getSalary))).get("eng")==Integer.MIN_VALUE);ok(employees.stream().collect(Collectors.groupingBy(Employee::getDepartment,Collectors.summingLong(Employee::getSalary))).get("eng")==2147483648L);fails(NullPointerException.class,()->Stream.of(new Employee(null,1)).collect(Collectors.groupingBy(Employee::getDepartment)));
 Stream<Integer> once=Stream.of(1);once.count();fails(IllegalStateException.class,()->once.count());
 List<Integer> path=new ArrayList<>(List.of(1));List<List<Integer>> res=new ArrayList<>();res.add(new ArrayList<>(path));path.clear();ok(res.get(0).equals(List.of(1)));
 int l=Integer.MIN_VALUE,r=Integer.MAX_VALUE;int mid=(int)(l+((long)r-l)/2);ok(mid==-1);ok((int)(l+((long)r-l+1L)/2)==0);
 System.out.println(checks+" API boundary checks passed");
 }
}