require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    console.log("Checking if we can invoke send-line-notify edge function...");
    
    // Let's first check if there are recent transactions in the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    console.log("One hour ago:", oneHourAgo);
    
    const { data: txData, error: txError } = await supabase
        .from('stock_transactions')
        .select(`
            id, 
            created_at, 
            quantity_change, 
            transaction_type,
            performed_by,
            stock_items ( name, unit, current_quantity, min_stock_threshold, reorder_point )
        `)
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: true });

    if (txError) {
        console.error("Error fetching transactions:", txError);
        return;
    }

    console.log(`Found ${txData ? txData.length : 0} transactions in the last hour.`);

    // Even if there are no transactions, we can mock a test payload to verify the LINE push succeeds.
    // Let's prepare a test payload.
    const message = "📦 Test Stock Update Push (Antigravity Debug)\n\n1. Test Item\n   (ทำรายการ: รับเข้า)\n   สถานะล่าสุด: 10 ชิ้น 🟢\n\nโดย: Antigravity";
    const flexPayload = {
        type: "flex",
        altText: "📦 Test Stock Update Push (Antigravity Debug)",
        contents: {
            type: "bubble",
            size: "mega",
            styles: {
                body: {
                    backgroundColor: "#F4F4F4"
                },
                footer: {
                    backgroundColor: "#F4F4F4",
                    separator: true,
                    separatorColor: "#EAEAEA"
                }
            },
            body: {
                type: "box",
                layout: "vertical",
                paddingAll: "xl",
                spacing: "md",
                contents: [
                    {
                        type: "text",
                        text: "SYSTEM // STOCK UPDATE TEST",
                        size: "xxs",
                        color: "#8C8C8C",
                        weight: "bold"
                    },
                    {
                        type: "text",
                        text: "1 ชั่วโมงล่าสุด (หน้า 1/1)",
                        size: "xl",
                        weight: "bold",
                        color: "#1C1C1C"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        spacing: "xs",
                        alignItems: "center",
                        contents: [
                            {
                                type: "text",
                                text: "●",
                                color: "#1C6C38",
                                size: "xs",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: "TEST REPORT GENERATED",
                                size: "xs",
                                weight: "bold",
                                color: "#1C1C1C",
                                flex: 1
                            }
                        ]
                    },
                    {
                        type: "separator",
                        color: "#EAEAEA",
                        margin: "md"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "md",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                margin: "md",
                                contents: [
                                    {
                                        type: "box",
                                        layout: "vertical",
                                        flex: 6,
                                        contents: [
                                            {
                                                type: "text",
                                                text: "01 // Test Item (กล่อง)",
                                                weight: "bold",
                                                size: "sm",
                                                color: "#1C1C1C",
                                                wrap: true
                                            },
                                            {
                                                type: "text",
                                                text: "ACTION: IN",
                                                size: "xxs",
                                                color: "#8C8C8C",
                                                margin: "xs"
                                            }
                                        ]
                                    },
                                    {
                                        type: "box",
                                        layout: "vertical",
                                        flex: 5,
                                        alignItems: "flex-end",
                                        contents: [
                                            {
                                                type: "text",
                                                text: "10.00 กล่อง",
                                                size: "sm",
                                                weight: "bold",
                                                color: "#1C1C1C",
                                                align: "end"
                                            },
                                            {
                                                type: "box",
                                                layout: "horizontal",
                                                spacing: "xs",
                                                alignItems: "center",
                                                margin: "xs",
                                                contents: [
                                                    {
                                                        type: "text",
                                                        text: "●",
                                                        color: "#1C6C38",
                                                        size: "xxs",
                                                        flex: 0
                                                    },
                                                    {
                                                        type: "text",
                                                        text: "OK",
                                                        size: "xxs",
                                                        color: "#8C8C8C",
                                                        weight: "bold",
                                                        flex: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "md",
                contents: [
                    {
                        type: "text",
                        text: "ITH-STOCK // BY ANTIGRAVITY",
                        size: "xxs",
                        color: "#A5A5A5",
                        weight: "bold",
                        align: "center"
                    }
                ]
            }
        }
    };

    console.log("Invoking supabase function 'send-line-notify'...");
    try {
        const { data: resData, error: invokeError } = await supabase.functions.invoke('send-line-notify', {
            body: { message, flexPayload }
        });

        if (invokeError) {
            console.error("Supabase function invoke error:", invokeError);
            if (invokeError.context) {
                try {
                    const text = await invokeError.context.text();
                    console.log("Response text:", text);
                } catch (e) {
                    console.error("Could not read response text:", e);
                }
            }
        } else {
            console.log("Invocation result:", resData);
        }
    } catch (err) {
        console.error("Exception occurred during invoke:", err);
    }
}

run();
