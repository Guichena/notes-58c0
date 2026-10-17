import json,pathlib,re,html,subprocess,os
R=pathlib.Path(__file__).resolve().parent;T=R/'syntax-03-04-tests';T.mkdir(exist_ok=True)
def run(cmd,input=None):
 p=subprocess.run(cmd,input=input,text=True,capture_output=True,timeout=25,env={**os.environ,'JAVA_TOOL_OPTIONS':'-Xmx128m -XX:ActiveProcessorCount=1'})
 log.append({'cmd':cmd,'input':input,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});return p
log=[];checks=[]
p=run(["java","-version"]);assert p.returncode==0
assert "21." in p.stderr,p.stderr
for b in ['03','04']:
 for e in json.load(open(R/('syntax-'+b)/'staged-entries.json')):
  n=int(e['id'].split('-')[1]); blocks=[html.unescape(x) for x in re.findall(r'<pre[^>]*>(.*?)</pre>',e['html'],re.S)]
  if n not in [28,30,31,34]:continue
  code=next(x for x in blocks if 'class Main' in x or 'class Solution' in x);d=T/e['id'];d.mkdir(exist_ok=True);name='Solution' if n==30 else 'Main';(d/(name+'.java')).write_text(code)
  p=run(['java','com.sun.tools.javac.Main','-d',str(d),str(d/(name+'.java'))]);assert p.returncode==0,p.stderr
  checks.append({'test':e['id']+' exact decoded complete class compile','passed':True})
  if n!=30:
   cases=[('0\n',''),('3\n1 2 3\n','')] if n!=31 else [('4 9\n2 7 11 15\n','0 1\n'),('2 6\n3 3\n','0 1\n'),('0 1\n',''),('2 -2147483648\n2147483647 1\n','')]
   for inp,want in cases:
    p=run(['java','-cp',str(d),'Main'],inp);assert p.returncode==0 and p.stdout==want,(n,p.stdout,p.stderr);checks.append({'test':e['id']+' input '+repr(inp),'passed':True})
   inp='2 5\n1\n' if n==31 else '2\n1\n';p=run(['java','-cp',str(d),'Main'],inp);assert p.returncode!=0 and 'EOFException' in p.stderr;checks.append({'test':e['id']+' truncated input EOFException','passed':True})
  else:
   harness='''class SolutionCheck { public static void main(String[] args) { Solution s=new Solution(); if(s.twoSum(new int[]{Integer.MAX_VALUE,1},Integer.MIN_VALUE).length!=0)throw new AssertionError(); if(s.twoSum(new int[]{3,3},6).length!=2)throw new AssertionError(); if(s.twoSum(new int[]{},0).length!=0)throw new AssertionError(); System.out.println("Solution boundaries passed"); }}''';(d/'SolutionCheck.java').write_text(harness);p=run(['java','com.sun.tools.javac.Main','-cp',str(d),'-d',str(d),str(d/'SolutionCheck.java')]);assert p.returncode==0;p=run(['java','-cp',str(d),'SolutionCheck']);assert p.returncode==0;checks.append({'test':'Solution30 overflow, duplicates, empty','passed':True})
d=T/'api';d.mkdir(exist_ok=True)
code='''import java.util.*;
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
}'''
(d/'ApiBoundaries.java').write_text(code);p=run(['java','com.sun.tools.javac.Main','-d',str(d),str(d/'ApiBoundaries.java')]);assert p.returncode==0,p.stderr;p=run(['java','-cp',str(d),'ApiBoundaries']);assert p.returncode==0,p.stderr;checks.append({'test':'API representative boundary harness','passed':True,'output':p.stdout})
(R/'syntax-03-04-test-results.json').write_text(json.dumps({'status':'passed','checks':checks,'log':log,'limits':'Exact 3 Main blocks and 1 Solution compiled; representative API harness is not every original snippet. No historic JDK, stress, performance, browser or external service tests.'},ensure_ascii=False,indent=2)+'\n')
print(len(checks),'test records passed')
