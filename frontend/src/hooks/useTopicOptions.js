import { useEffect, useState } from 'react';
import { subjectAPI } from '../services/api.js';

/** Loads every topic the user owns as `{ id, subjectId, name, label }` options (subjects include their topics). */
export default function useTopicOptions() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    subjectAPI.list()
      .then(({ data }) => {
        if (cancelled) return;
        setTopics(data.data.subjects.flatMap((subject) => subject.topics.map((topic) => ({
          id: topic.id,
          subjectId: subject.id,
          name: topic.name,
          label: `${subject.name} / ${topic.name}`,
        }))));
      })
      .catch(() => { if (!cancelled) setTopics([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { topics, loading };
}
