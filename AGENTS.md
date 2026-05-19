# QuizScan-AI Instructions

## Database Schema (Supabase)

To enable real-time syncing, please run the following SQL in your Supabase SQL Editor:

```sql
-- Create Quizzes Table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  answer_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Submissions Table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  grading_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- (Optional) Enable Row Level Security
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Simple public access (Update if you add Auth)
CREATE POLICY "Public Access" ON quizzes FOR ALL USING (true);
CREATE POLICY "Public Access" ON submissions FOR ALL USING (true);
```

## Features
- **Visual Grading**: Gemini AI vision parses handwritten or printed student papers.
- **Answer Key Matching**: Compare student work against a custom text-based answer key.
- **Cloud Sync**: All results are saved instantly to Supabase.
- **Academic Dashboard**: High-level stats on time saved and class accuracy.
