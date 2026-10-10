"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  const isSignup = mode === "signup";

  const handleChange = (field: keyof typeof formState) => (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const payload = isSignup
        ? {
          name: formState.name,
          phone: formState.phone,
          email: formState.email,
          password: formState.password,
        }
        : {
          email: formState.email,
          password: formState.password,
        };

      const response = await fetch(isSignup ? "/api/signup" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Request failed" }));
        toast.error(data.message ?? "Something went wrong");
        return;
      }

      toast.success(isSignup ? "Welcome to CarePilot!" : "Welcome back!");
      router.push("/admin");
      router.refresh();
    });
  };

  return (
    <Card className="bg-white backdrop-blur-md border-2 border-[#0097b2]/30 shadow-2xl transition-all duration-300">
      <CardHeader className="pt-8">
        <CardTitle className="text-3xl font-parisienne text-[#0097b2] text-center">
          {isSignup ? "Create your account" : "Welcome back"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-[#004d6d]">Full name</Label>
                <Input
                  id="name"
                  placeholder="Jordan Lee"
                  value={formState.name}
                  onChange={handleChange("name")}
                  required
                  className="text-[#004d6d] bg-white border-[#0097b2]/30 placeholder:text-[#004d6d]/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-[#004d6d]">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 555 123 4567"
                  value={formState.phone}
                  onChange={handleChange("phone")}
                  required
                  className="text-[#004d6d] bg-white border-[#0097b2]/30 placeholder:text-[#004d6d]/40"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-[#004d6d]">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@carepilot.com"
              value={formState.email}
              onChange={handleChange("email")}
              required
              className="text-[#004d6d] bg-white border-[#0097b2]/30 placeholder:text-[#004d6d]/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-[#004d6d]">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formState.password}
              onChange={handleChange("password")}
              required
              className="text-[#004d6d] bg-white border-[#0097b2]/30 placeholder:text-[#004d6d]/40"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#f66] hover:bg-[#f66]/90 text-white font-bold rounded-full py-6 text-lg transition-all duration-300 shadow-xl hover:shadow-2xl"
            disabled={isPending}
          >
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-sm text-[#004d6d]/90">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="text-[#0097b2] hover:underline">
            {isSignup ? "Sign in" : "Start free trial"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
