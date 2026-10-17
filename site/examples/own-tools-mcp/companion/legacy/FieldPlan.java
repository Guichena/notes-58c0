import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Tiny explicit filter grammar, NOT an unrestricted natural-language parser or SQL validator. */
public final class FieldPlan {
    private FieldPlan() {}
    private static final Pattern CLAUSE=Pattern.compile("(类别|年份|姓名)=([^;\\p{Cntrl}]{1,80})");
    public record Query(String sql,List<Object> parameters) {}
    public static Query parse(String input,long authenticatedTenant,int limit) {
        if(input==null || input.length()>260 || authenticatedTenant<=0 || limit<1 || limit>50)throw new IllegalArgumentException();
        String[] clauses=input.split(";",-1);if(clauses.length<1 || clauses.length>3)throw new IllegalArgumentException();
        StringBuilder sql=new StringBuilder("SELECT id,title FROM book WHERE tenant_id=?");
        List<Object> parameters=new ArrayList<>();parameters.add(authenticatedTenant);Set<String> seen=new HashSet<>();
        for(String clause:clauses) {
            Matcher m=CLAUSE.matcher(clause);if(!m.matches() || !seen.add(m.group(1)))throw new IllegalArgumentException("unsupported/duplicate clause");
            String column;Object value;
            switch(m.group(1)) {
                case "类别" -> { column="category";value=m.group(2); }
                case "姓名" -> { column="author_name";value=m.group(2); }
                case "年份" -> { column="published_year";String text=m.group(2);
                    if(!text.matches("[0-9]{4}"))throw new IllegalArgumentException("explicit four-digit year required");
                    int year=Integer.parseInt(text);if(year<1000)throw new IllegalArgumentException();value=year; }
                default -> throw new IllegalArgumentException();
            }
            sql.append(" AND ").append(column).append("=?");parameters.add(value);
        }
        sql.append(" ORDER BY id LIMIT ?");parameters.add(limit);
        return new Query(sql.toString(),List.copyOf(parameters));
    }
}

