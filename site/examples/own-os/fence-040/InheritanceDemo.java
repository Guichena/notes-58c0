public final class InheritanceDemo {
    interface Named {
        String describe();
    }

    static class Parent implements Named {
        protected final String name;

        Parent(String name) {
            this.name = name;
        }

        @Override
        public String describe() {
            return "parent:" + name;
        }
    }

    static final class Child extends Parent {
        private final int level;

        Child(String name, int level) {
            super(name);
            this.level = level;
        }

        @Override
        public String describe() {
            return super.describe() + ":level=" + level;
        }
    }

    public static void main(String[] args) {
        Parent parent = new Child("task", 2);
        Named named = parent;
        if (!"parent:task:level=2".equals(named.describe())) {
            throw new AssertionError("dynamic dispatch failed");
        }
        System.out.println(named.describe());
    }
}
