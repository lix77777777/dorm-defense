import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBG13sf3G1q21Qe8L21pwcb15Q6QKvR_jk",
  authDomain: "tafang-831fa.firebaseapp.com",
  projectId: "tafang-831fa",
  storageBucket: "tafang-831fa.firebasestorage.app",
  messagingSenderId: "756711920189",
  appId: "1:756711920189:web:aca84559d69d92372d9054",
  measurementId: "G-B6XYLRVPMM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function submitScore(entry) {
  const ref = await addDoc(collection(db, "leaderboard"), {
    nickname: entry.nickname,
    score: Math.round(entry.score),
    wave: entry.wave,
    difficulty: entry.difficulty
  });
  return ref.id;
}

export async function fetchLeaderboard(max = 200) {
  const q = query(
    collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
