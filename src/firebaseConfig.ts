import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import config from "../firebase-applet-config.json";

const app = initializeApp(config);
// @ts-expect-error - config may not have firestoreDatabaseId
export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth();
