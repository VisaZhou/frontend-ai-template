"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

type UseSSEChatProps = {
  apiEndpoint: string
}

export function useSSEChat({ apiEndpoint }: UseSSEChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 生成唯一ID
  const generateId = () => Math.random().toString(36).substring(2, 10)

  // 组件卸载时关闭 EventSource 连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: message,
    }

    // 添加用户消息
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // 创建新的 AI 消息占位
    const assistantMessageId = generateId()
    setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }])

    // 关闭之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // 创建 SSE 连接
    const url = `${apiEndpoint}?message=${encodeURIComponent(message)}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        if (event.data === "[DONE]") {
          setIsLoading(false)
          eventSource.close()
          return
        }

        const data = JSON.parse(event.data)

        // 更新 AI 消息内容
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: msg.content + (data.content || "") } : msg,
          ),
        )
      } catch (error) {
        console.error("Error parsing SSE message:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error)
      setIsLoading(false)
      eventSource.close()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return {
    messages,
    input,
    isLoading,
    handleInputChange,
    handleSubmit,
    sendMessage,
  }
}
