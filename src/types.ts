export interface Quiz {
  id: string;
  title: string;
  answer_key: string;
  created_at: string;
}

export interface Submission {
  id: string;
  quiz_id: string;
  student_name: string;
  score: number;
  max_score: number;
  grading_payload: any;
  image_url?: string;
  created_at: string;
}

export interface GradingResult {
  studentName: string;
  totalScore: number;
  maxScore: number;
  results: Array<{
    questionNumber: number;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    feedback: string;
  }>;
  overallFeedback: string;
}
