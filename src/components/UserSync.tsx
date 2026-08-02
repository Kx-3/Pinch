"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserSync() {
  const { userId, isSignedIn } = useAuth();
  const storeUser = useMutation(api.functions.users.storeUser);

  useEffect(() => {
    if (isSignedIn && userId) {
      storeUser()
        .then(() => {
          console.log("User synced successfully");
        })
        .catch((err) => {
          console.error("Failed to sync user:", err);
        });
    }
  }, [isSignedIn, userId, storeUser]);

  return null;
}
