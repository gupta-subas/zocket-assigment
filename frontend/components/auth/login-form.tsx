"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Code,
  Zap,
  Shield,
  Users,
  CheckCircle,
  ArrowRight,
  Star,
} from "lucide-react";
import { login } from "@/lib/api/auth";
import { useAuth } from "@/components/providers/auth-provider";

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login: authLogin } = useAuth();

  const loginForm = useForm<LoginFormData>();

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(data);
      authLogin(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Product Details */}
      <div className="hidden lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div className="max-w-lg mx-auto space-y-8">
          {/* Brand Header */}
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center justify-center">
              <Image
                src="/assets/zocket-black-text-logo.svg"
                alt="Zocket"
                width={114}
                height={28}
                className="h-8 w-auto dark:invert"
              />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">AI Coding Assistant</p>
            </div>
          </div>

          {/* Hero Content */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">
              Build faster with AI-powered coding assistance
            </h2>
            <p className="text-lg text-muted-foreground">
              Get intelligent code suggestions, debug faster, and build amazing
              applications with our advanced AI coding assistant.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Features</h3>

            <div className="grid gap-4">
              <Card className="p-4">
                <div className="flex items-start space-x-3">
                  <Code className="h-5 w-5 mt-1" />
                  <div>
                    <h4 className="font-medium">Smart Code Generation</h4>
                    <p className="text-sm text-muted-foreground">
                      Generate clean, efficient code in multiple programming
                      languages
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start space-x-3">
                  <Zap className="h-5 w-5 mt-1" />
                  <div>
                    <h4 className="font-medium">Instant Debugging</h4>
                    <p className="text-sm text-muted-foreground">
                      Find and fix bugs quickly with AI-powered analysis
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 mt-1" />
                  <div>
                    <h4 className="font-medium">Code Security</h4>
                    <p className="text-sm text-muted-foreground">
                      Built-in security scanning and vulnerability detection
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start space-x-3">
                  <Users className="h-5 w-5 mt-1" />
                  <div>
                    <h4 className="font-medium">Team Collaboration</h4>
                    <p className="text-sm text-muted-foreground">
                      Share and collaborate on code projects seamlessly
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex flex-col items-center justify-center space-y-4 mb-8">
            <div className="flex items-center justify-center">
              <Image
                src="/assets/zocket-black-text-logo.svg"
                alt="Zocket"
                width={114}
                height={28}
                className="h-8 w-auto dark:invert"
              />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">AI Coding Assistant</p>
            </div>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">
                Welcome back
              </CardTitle>
              <CardDescription className="text-center">
                Sign in to continue building amazing projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    {...loginForm.register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                    })}
                    type="email"
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <Input
                    id="password"
                    {...loginForm.register("password", {
                      required: "Password is required",
                    })}
                    type="password"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <Separator />

              {/* Demo Notice */}
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Demo Access:</strong> Use any valid email format and
                  password to access the demo environment.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center space-x-2">
            <Badge variant="outline" className="text-xs">
              <Shield className="mr-1 h-3 w-3" />
              Secure Authentication
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Star className="mr-1 h-3 w-3" />
              Enterprise Ready
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
