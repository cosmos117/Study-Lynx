-- Composite indexes for the topic page's quiz lookups and for starting a Pomodoro session.
-- CreateIndex
CREATE INDEX `QuizResult_userId_topicId_attemptedAt_idx` ON `QuizResult`(`userId`, `topicId`, `attemptedAt`);

-- CreateIndex
CREATE INDEX `StudySession_userId_topicId_status_idx` ON `StudySession`(`userId`, `topicId`, `status`);

