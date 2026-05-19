import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// grading endpoint
app.post("/api/grade", async (req, res) => {
  try {
    const { image, answerKey, studentNameInput } = req.body;

    if (!image || !answerKey) {
      return res.status(400).json({ error: "Image and Answer Key are required" });
    }

    const apiKey = (process.env.GEMINI_API_KEY || "").replace(/['"]/g, "").trim();
    const isMockMode = !apiKey || !apiKey.startsWith("AIzaSy");

    if (isMockMode) {
      console.log("Using Mock Grader because GEMINI_API_KEY is not configured.");
      
      // Simulate slow AI response
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Parse answer key lines to generate mock results
      const lines = answerKey.split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
        
      const results = [];
      let correctCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // expected format e.g. "Q1: A" or "1: A" or just "A"
        const parts = line.split(':');
        const qNum = i + 1;
        const expectedAns = parts[1] ? parts[1].trim() : parts[0].trim();
        
        // Randomly make some correct and some incorrect for realistic mock grading
        const isCorrect = Math.random() > 0.15; // 85% chance of correct
        const studentAns = isCorrect ? expectedAns : (expectedAns === 'A' || expectedAns === 'a' ? 'B' : (expectedAns === 'True' || expectedAns === 'true' ? 'False' : 'A'));
        
        if (isCorrect) correctCount++;
        
        results.push({
          questionNumber: qNum,
          studentAnswer: studentAns,
          correctAnswer: expectedAns,
          isCorrect: isCorrect,
          feedback: isCorrect ? "Correct answer. Excellent choice." : `Incorrect. Expected "${expectedAns}", but the student marked "${studentAns}".`
        });
      }

      const totalScore = correctCount;
      const maxScore = lines.length || 10;

      const mockGradingResult = {
        studentName: studentNameInput && studentNameInput !== "Student" ? studentNameInput : "Alex Mercer",
        totalScore,
        maxScore,
        results,
        overallFeedback: `### Instructor Feedback Summary\n\n- The student demonstrated a solid understanding of the material, scoring **${((totalScore / maxScore) * 100).toFixed(0)}%**.\n- Most questions were answered correctly with clear logic.\n- **Recommendation:** Review the topics where errors occurred to solidify comprehension before the final exam.`,
        isMock: true
      };

      return res.json(mockGradingResult);
    }

    const prompt = `
      You are an expert academic grader. Your task is to grade a student's quiz paper based on a provided answer key.
      
      STUDENT NAME (if detectable from paper, otherwise use the one provided): ${studentNameInput || "Unknown"}
      
      ANSWER KEY:
      ${answerKey}
      
      INSTRUCTIONS:
      1. Extract the student's name from the top of the paper if it exists and differs from the provided input.
      2. Compare the student's answers in the image to the answer key.
      3. Calculate a total score based on the number of correct answers.
      4. Provide a reasoning for each marked question (e.g., "Correct", "Incorrect - expected X", "Partially correct").
      5. Return the result strictly in JSON format.

      Return a JSON object with this schema:
      {
        "studentName": "string",
        "totalScore": number,
        "maxScore": number,
        "results": [
          {
            "questionNumber": number,
            "studentAnswer": "string",
            "correctAnswer": "string",
            "isCorrect": boolean,
            "feedback": "string"
          }
        ],
        "overallFeedback": "string"
      }
    `;

    const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: image.split(',')[1] || image,
              }
            },
            {
              text: prompt,
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    };

    const fetchResponse = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!fetchResponse.ok) {
      const errText = await fetchResponse.text();
      throw new Error(`Gemini API Error: ${fetchResponse.status} - ${errText}`);
    }

    const data: any = await fetchResponse.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const gradingResult = JSON.parse(textResponse);
    res.json(gradingResult);

  } catch (error: any) {
    console.error("Grading error:", error);
    res.status(500).json({ error: error.message || "Failed to grade image" });
  }
});

// parsing answer key endpoint
app.post("/api/parse-key", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    const apiKey = (process.env.GEMINI_API_KEY || "").replace(/['"]/g, "").trim();
    const isMockMode = !apiKey || !apiKey.startsWith("AIzaSy");

    if (isMockMode) {
      console.log("Using Mock Key Parser because GEMINI_API_KEY is not configured.");
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockKeyText = `Q1: A\nQ2: B\nQ3: C\nQ4: D\nQ5: A\nQ6: B\nQ7: C\nQ8: D\nQ9: A\nQ10: B`;
      return res.json({ text: mockKeyText, isMock: true });
    }

    const prompt = `
      You are an expert academic assistant. Extract the questions and correct answers from this quiz answer key image.
      Provide the output as a simple, human-readable text list where each line is a question and its answer.
      Example:
      Q1: A
      Q2: B
      Q3: 15
      
      Return ONLY the plain text of the extracted keys, no conversational filler.
    `;

    const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: image.split(',')[1] || image,
              }
            },
            {
              text: prompt,
            }
          ]
        }
      ]
    };

    const fetchResponse = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!fetchResponse.ok) {
      const errText = await fetchResponse.text();
      throw new Error(`Gemini API Error: ${fetchResponse.status} - ${errText}`);
    }

    const data: any = await fetchResponse.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text: textResponse });

  } catch (error: any) {
    console.error("Parse key error:", error);
    res.status(500).json({ error: error.message || "Failed to parse answer key" });
  }
});

// Provide Supabase config to client
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

export default app;
