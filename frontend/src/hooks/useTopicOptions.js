import { useEffect, useState } from 'react';
import { examAPI, subjectAPI, topicAPI } from '../services/api.js';

const PAGE = { page: 1, limit: 100 };

/** Loads every topic the user owns as `{ id, examId, label, shortLabel }` options. */
export default function useTopicOptions() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const exams = (await examAPI.list(PAGE)).data.data.items;
        const perExam = await Promise.all(exams.map(async (exam) => {
          const subjects = (await subjectAPI.list(exam.id, PAGE)).data.data.items;
          const perSubject = await Promise.all(subjects.map(async (subject) => {
            const items = (await topicAPI.list(subject.id, PAGE)).data.data.items;
            return items.map((topic) => ({
              id: topic.id,
              examId: exam.id,
              label: `${exam.name} / ${subject.name} / ${topic.name}`,
              shortLabel: `${subject.name} / ${topic.name}`,
            }));
          }));
          return perSubject.flat();
        }));
        if (!cancelled) setTopics(perExam.flat());
      } catch {
        if (!cancelled) setTopics([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { topics, loading };
}
