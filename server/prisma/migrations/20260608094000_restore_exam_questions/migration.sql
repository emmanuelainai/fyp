-- Recreate exam questions removed by the previous schema migration.
CREATE TYPE "QuestionType" AS ENUM ('SHORT_TEXT', 'MULTIPLE_CHOICE');

CREATE TABLE "ExamQuestion" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SHORT_TEXT',
    "options" JSONB,
    "correctOptionIndex" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamQuestion_examId_idx" ON "ExamQuestion"("examId");
CREATE UNIQUE INDEX "ExamQuestion_examId_order_key" ON "ExamQuestion"("examId", "order");

ALTER TABLE "ExamQuestion"
ADD CONSTRAINT "ExamQuestion_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
