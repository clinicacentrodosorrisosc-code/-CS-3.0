"use client";

import { CheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type BorderAvatarProps = { src?: string; alt?: string; fallback?: string; size?: "sm" | "md" };

const BorderAvatarDemo = ({
  src = "https://cdn.21st.dev/assets/mirror/c7/c7097eeb66ad097b6e5f9dbb95ae857cd6b55c0ad398c1ea84f3ab90a02c631e.jpg",
  alt = "Perfil do usuário",
  fallback = "HR",
  size = "sm",
}: BorderAvatarProps) => {
  const avatarSize = size === "md" ? "h-11 w-11" : "h-8 w-8";
  const badgeSize = size === "md" ? "size-4.5 -right-1.5 -bottom-1.5" : "size-4 -right-1 -bottom-1";

  return (
    <div className="relative w-fit">
      <Avatar className={`${avatarSize} ring-offset-background ring-2 ring-teal-600 ring-offset-2 dark:ring-teal-400`}>
        <AvatarImage src={src} alt={alt} />
        <AvatarFallback className="text-[10px] font-bold">{fallback}</AvatarFallback>
      </Avatar>
      <span className={`absolute inline-flex items-center justify-center rounded-full bg-teal-600 dark:bg-teal-400 ${badgeSize}`} aria-label="Perfil verificado">
        <CheckIcon className="size-3 text-white" />
      </span>
    </div>
  );
};

export default BorderAvatarDemo;
