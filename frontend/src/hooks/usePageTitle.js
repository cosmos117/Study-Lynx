import { useEffect } from 'react';

/** Sets the browser tab / screen-reader page title, e.g. "Materials | Study Lynx". */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Study Lynx` : 'Study Lynx | Focus better';
  }, [title]);
}
