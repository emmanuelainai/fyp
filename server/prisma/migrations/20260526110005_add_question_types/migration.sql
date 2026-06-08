-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SHORT_TEXT', 'MULTIPLE_CHOICE');

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "correctOptionIndex" INTEGER,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'SHORT_TEXT';
