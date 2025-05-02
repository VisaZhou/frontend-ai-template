"use client"
import { useState, useEffect, useRef, type FormEvent } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SendIcon, BotIcon, UserIcon } from "lucide-react"

// 定义消息类型
type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 10)

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input,
    }

    // 添加用户消息
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // 创建新的 AI 消息占位
    const assistantMessageId = generateId()
    setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }])

    try {
      const response = await fetch("/api/flux-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [userMessage]
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No reader available")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          setIsLoading(false)
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        console.log("Processing lines:", lines)

        for (const line of lines) {
          console.log("Processing line:", line)
          if (line.startsWith("data:")) {
            const jsonStr = line.slice(5).trim()
            console.log("JSON string:", jsonStr)
            if (jsonStr === "[DONE]") {
              setIsLoading(false)
              return
            }
            try {
              const jsonData = JSON.parse(jsonStr)
              console.log("Parsed JSON:", jsonData)
              // 直接从 result.output.text 获取文本
              const text = jsonData?.result?.output?.text || ""
              console.log("Extracted text:", text)
              if (text) {
                console.log("Updating message with text:", text)
                setMessages((prev) => {
                  const newMessages = prev.map((msg) =>
                    msg.id === assistantMessageId 
                      ? { ...msg, content: msg.content + text } 
                      : msg,
                  )
                  console.log("New messages state:", newMessages)
                  return newMessages
                })
              }
            } catch (error) {
              console.error("Error parsing JSON:", error, "Raw data:", jsonStr)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in chat:", error)
      setIsLoading(false)
      // 添加错误消息
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: "抱歉，发生错误，请稍后重试。" }
            : msg,
        ),
      )
    }
  }

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
              onChange={(e) => setInput(e.target.value)}
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