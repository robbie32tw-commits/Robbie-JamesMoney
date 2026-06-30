import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';

const COLLECTION = 'scripts';

export async function uploadScriptFile(file) {
  const path = `scripts/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { fileUrl: url, filePath: path, fileName: file.name };
}

export async function deleteScriptFile(filePath) {
  if (!filePath) return;
  await deleteObject(ref(storage, filePath)).catch(() => {});
}

export function useScripts() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setScripts(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addScript = async (script) => {
    await addDoc(collection(db, COLLECTION), {
      ...script,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updateScript = async (id, updates) => {
    await updateDoc(doc(db, COLLECTION, id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteScript = async (id, filePath) => {
    await deleteScriptFile(filePath);
    await deleteDoc(doc(db, COLLECTION, id));
  };

  return { scripts, loading, addScript, updateScript, deleteScript };
}

export function useTags(scripts) {
  const allTags = [...new Set(scripts.flatMap((s) => s.tags || []))].sort();
  return allTags;
}
