"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Wrapper Sonner. Sur téléphone, les toasts arrivent en bas AU-DESSUS de
 * la barre d'onglets et de la barre d'action (sinon ils passaient
 * derrière), et le thème suit celui de l'app (classe « dark » sur html).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const lire = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    lire();
    const obs = new MutationObserver(lire);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return (
    <Sonner
      theme={theme}
      mobileOffset={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))", left: "1rem", right: "1rem" }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
