CREATE TABLE scores (
  student_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  PRIMARY KEY(student_id,course_id),
  FOREIGN KEY(student_id) REFERENCES students(student_id),
  FOREIGN KEY(course_id) REFERENCES courses(course_id)
) ENGINE=InnoDB;
INSERT INTO scores VALUES
 (1,1,80),(1,2,90),(2,1,100),(2,2,70),(3,1,75),(3,2,75);
