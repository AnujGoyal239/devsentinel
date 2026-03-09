import { NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming analysis progress updates
 * GET /api/stream/:runId
 * 
 * Streams real-time progress updates for an analysis run:
 * - Polls analysis_runs table every 1 second
 * - Emits SSE events with status, stage, progress
 * - Closes connection when status is "complete" or "failed"
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { runId } = params;

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const supabase = await createClient();

        // Poll every 1 second
        const interval = setInterval(async () => {
          try {
            // Query analysis_runs table for current status
            const { data: run, error } = await supabase
              .from('analysis_runs')
              .select('status, current_stage, current_progress, health_score, error_message')
              .eq('id', runId)
              .single();

            if (error) {
              console.error('Error fetching analysis run:', error);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Failed to fetch analysis status' })}\n\n`
                )
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            if (!run) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Analysis run not found' })}\n\n`
                )
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            // Emit SSE event with current progress
            const eventData = {
              status: run.status,
              stage: run.current_stage || 'Initializing...',
              progress: run.current_progress || 0,
              ...(run.health_score !== null && { health_score: run.health_score }),
              ...(run.error_message && { error_message: run.error_message }),
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
            );

            // Close connection if analysis is complete or failed
            if (run.status === 'complete' || run.status === 'failed') {
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
