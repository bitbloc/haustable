import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// ป้องกันการ Initialize ซ้ำ (Best Practice)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// export ตัวแปร db ไปใช้งานในหน้าอื่นๆ เพื่อดึงข้อมูลออเดอร์
// export ตัวแปร db ไปใช้งานในหน้าอื่นๆ เพื่อดึงข้อมูลออเดอร์
export const db = getFirestore(app);

// Check if supported (e.g., in browser and not server-side)
let messaging = null;
if (typeof window !== "undefined") {
  import("firebase/messaging").then(({ getMessaging }) => {
    messaging = getMessaging(app);
  });
}

export { messaging };
export default app;
