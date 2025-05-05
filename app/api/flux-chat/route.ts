import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    
    // 获取最后一条用户消息
    const lastUserMessage = messages[messages.length - 1].content

    console.log("Sending request to Springboot:", {
      message: lastUserMessage
    })

    // 创建 SSE 连接，使用新的 URL
    const response = await fetch(`http://localhost:8000/deepseek/chat/ai/memory?message=${encodeURIComponent(lastUserMessage)}`, {
      method: "GET",
      headers: {
        "Accept": "text/event-stream",
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Springboot error response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    // 转换响应流
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.close()
              break
            }
            const chunk = decoder.decode(value, { stream: true })
            console.log("Received chunk:", chunk)
            controller.enqueue(new TextEncoder().encode(chunk))
          }
        } catch (error) {
          console.error("Error reading stream:", error)
          controller.error(error)
        }
      },
    })

    // 返回 SSE 响应
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in chat route:", error)
    return new NextResponse(JSON.stringify({ 
      error: "Failed to connect to AI service",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}
