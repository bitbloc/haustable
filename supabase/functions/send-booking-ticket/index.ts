import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      lineUserId, 
      bookingId, 
      trackingToken, 
      customerName, 
      dateTime, 
      tableName, 
      itemsSummary, 
      totalAmount,
      shopLogoUrl,
      checkInUrl
    } = await req.json()

    if (!lineUserId) {
        throw new Error('lineUserId is required')
    }

    const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN_OA')
    if (!channelAccessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN_OA is not set')
    }

    // Build the "Concert Ticket" Flex Message
    const flexMessage = {
      type: "flex",
      altText: `Your Booking Ticket #${trackingToken || bookingId} is ready!`,
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "image",
                  url: shopLogoUrl || "https://placeholder.com/150",
                  size: "full",
                  aspectMode: "fit",
                  aspectRatio: "1:1",
                  gravity: "center"
                }
              ],
              width: "40px",
              height: "40px",
              cornerRadius: "100px",
              borderWidth: "1px",
              borderColor: "#E2E2E0"
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "HAUS TABLE",
                  weight: "bold",
                  color: "#1A1A1A",
                  size: "sm"
                },
                {
                  type: "text",
                  text: "BOOKING TICKET",
                  size: "xxs",
                  color: "#666666",
                  weight: "bold",
                  tracking: "widest"
                }
              ],
              margin: "md",
              justifyContent: "center"
            }
          ],
          paddingAll: "20px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                 {
                  type: "text",
                  text: "Customer",
                  color: "#888888",
                  size: "xxs",
                  weight: "bold",
                  wrap: true
                },
                {
                  type: "text",
                  text: customerName || "Guest",
                  weight: "bold",
                  size: "xl",
                  color: "#1A1A1A",
                  wrap: true
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "Date & Time",
                      color: "#888888",
                      size: "xxs",
                      weight: "bold"
                    },
                    {
                      type: "text",
                      text: dateTime || "-",
                      size: "sm",
                      color: "#1A1A1A",
                      weight: "bold"
                    }
                  ],
                  flex: 2
                },
                {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "Table",
                      color: "#888888",
                      size: "xxs",
                      weight: "bold"
                    },
                    {
                      type: "text",
                      text: tableName || "TBA",
                      size: "lg",
                      color: "#1A1A1A",
                      weight: "bold"
                    }
                  ],
                  flex: 1
                }
              ],
              margin: "lg"
            },
            {
              type: "separator",
              margin: "lg",
              color: "#E2E2E0"
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "Order Summary",
                  color: "#888888",
                  size: "xxs",
                  weight: "bold",
                  margin: "md"
                },
                {
                  type: "text",
                  text: itemsSummary || "No items",
                  size: "xs",
                  color: "#666666",
                  wrap: true,
                  margin: "sm"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "Total Amount",
                      color: "#666666",
                      size: "xs",
                      weight: "bold"
                    },
                    {
                      type: "text",
                      text: totalAmount ? `${totalAmount}.-` : "-",
                      color: "#1A1A1A",
                      size: "sm",
                      weight: "bold",
                      align: "end"
                    }
                  ],
                  margin: "md"
                }
              ]
            }
          ],
          paddingAll: "20px"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
             {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "Scan at the store to Check-in",
                  size: "xxs",
                  color: "#666666",
                  align: "center",
                  weight: "bold",
                  margin: "sm"
                }
              ],
              margin: "md"
            },
            {
               type: "image",
               url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInUrl || bookingId)}`,
               size: "md",
               margin: "md",
               aspectMode: "fit",
               aspectRatio: "1:1",
               align: "center"
            },
            {
              type: "text",
              text: `Ref: #${trackingToken || bookingId}`,
              size: "xxs",
              color: "#888888",
              align: "center",
              margin: "md"
            }
          ],
          paddingAll: "20px"
        },
        styles: {
          header: {
            backgroundColor: "#F4F4F3",
            separator: true,
            separatorColor: "#E2E2E0"
          },
          body: {
            backgroundColor: "#FFFFFF"
          },
          footer: {
            backgroundColor: "#F4F4F3",
            separator: true,
            separatorColor: "#E2E2E0"
          }
        }
      }
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [flexMessage],
      }),
    })

    const result = await res.json()

    if (!res.ok) {
        console.error('LINE API Error:', result)
        return new Response(JSON.stringify({ error: 'Failed to send Flex Message', details: result }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
