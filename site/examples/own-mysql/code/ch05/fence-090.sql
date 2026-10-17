CREATE TABLE teachers (
  teacher_id BIGINT PRIMARY KEY,
  teacher_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE students (
  student_id BIGINT PRIMARY KEY,
  student_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE courses (
  course_id BIGINT PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL,
  teacher_id BIGINT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
) ENGINE=InnoDB;
CREATE TABLE enrollments (
  student_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
) ENGINE=InnoDB;
