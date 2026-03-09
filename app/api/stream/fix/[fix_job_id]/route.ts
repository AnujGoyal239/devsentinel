import { NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0/edge';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming fix progress updates
 * GET /api/stream/fix/:fix_job_id
 * 
 * Streams real-time progress updates for a fix job:
 * - Polls fix_jobs table every 1 second
 * - Emits SSE events with status and latest agent_log entries
 * - Closes connection when status is "complete" or "failed"
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { fix_job_id: string } }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { fix_job_id } = params;

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const supabase = await createClient();
        let lastLogCount = 0;

        // Poll every 1 second
        const interval = setInterval(async () => {
          try {
            // Query fix_jobs table for current status and agent_log
            const { data: fixJob, error } = await supabase
              .from('fix_jobs')
              .select('status, agent_log, pr_url, pr_number, error_message')
              .eq('id', fix_job_id)
              .single();

            if (error) {
              console.error('Error fetching fix job:', error);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Failed to fetch fix status' })}\n\n`
                )
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            if (!fixJob) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Fix job not found' })}\n\n`
                )
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            // Get agent_log as array
            const agentLog = (fixJob.agent_log as any[]) || [];
            
            // Only emit new log entries since last poll
            const newLogs = agentLog.slice(lastLogCount);
            lastLogCount = agentLog.length;

            // Emit SSE event with current status and new log entries
            const eventData = {
              status: fixJob.status,
              logs: newLogs,
              ...(fixJob.pr_url && { pr_url: fixJob.pr_url }),
              ...(fixJob.pr_number && { pr_number: fixJob.pr_number }),
              ...(fixJob.error_message && { error_message: fixJob.error_message }),
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
            );

            // Close connection if fix is complete or failed
            if (fixJob.status === 'complete' || fixJob.status === 'failed') {
              clearInterval(interval);
              controller.close();
            }
          } catch (err) {
            console.error('Error in SSE stream:', err);
            clearInterval(interval);
            controller.close();
          }
        }, 1000);

        // Handle client disconnection
        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in SSE endpoint:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
