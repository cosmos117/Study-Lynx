-- Where playback stopped in a video, so it resumes there next time.
ALTER TABLE `LearningResource` ADD COLUMN `positionSeconds` INTEGER NOT NULL DEFAULT 0;
