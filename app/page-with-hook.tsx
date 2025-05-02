"use client"
import { useRef, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SendIcon, BotIcon, UserIcon } from "lucide-react"
import { useSSEChat } from "@/hooks/useSSEChat"

export default function ChatInterface() {
  const { messages, input, isLoading, handleInputChange, handleSubmit } = useSSEChat({
    apiEndpoint: "/api/chat",
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="text-center">AI 智能助手</CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-72 text-center text-muted-foreground">
                <BotIcon className="h-12 w-12 mb-4 text-muted-foreground/60" />
                <p>您好！我是您的 AI 助手，请输入您的问题。</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex gap-3 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className={message.role === "user" ? "bg-primary" : "bg-muted"}>
                      <AvatarFallback>
                        {message.role === "user" ? <UserIcon className="h-5 w-5" /> : <BotIcon className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {message.content ||
                        (message.role === "assistant" && isLoading ? (
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-2 w-2 bg-current rounded-full animate-bounce"></div>
                          </div>
                        ) : (
                          ""
                        ))}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <CardFooter className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              placeholder="输入您的问题..."
              value={input}
              onChange={handleInputChange}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <SendIcon className="h-4 w-4" />
              <span className="sr-only">发送</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
