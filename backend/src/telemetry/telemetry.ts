import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  collectorUrl: string | null;
  consoleExporter: boolean;
}

let sdk: NodeSDK | null = null;

export function readTelemetryConfig(): TelemetryConfig {
  return {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'cheesepay-backend',
    collectorUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    consoleExporter: process.env.OTEL_TRACE_CONSOLE === 'true',
  };
}

export function startTelemetry(config: TelemetryConfig): NodeSDK | null {
  const telemetryEnabled =
    config.enabled || Boolean(config.collectorUrl) || config.consoleExporter;

  if (!telemetryEnabled) {
    return null;
  }

  if (sdk) {
    return sdk;
  }

  sdk = new NodeSDK({
    serviceName: config.serviceName,
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    }),
    spanProcessors: buildSpanProcessors(config),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}

export async function traceAsyncOperation<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  operation: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer('cheese-backend');

  return tracer.startActiveSpan(name, async (span) => {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });

    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

function buildSpanProcessors(config: TelemetryConfig): SimpleSpanProcessor[] {
  const processors: SimpleSpanProcessor[] = [];

  if (config.collectorUrl) {
    processors.push(
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: config.collectorUrl,
        }),
      ),
    );
  }

  if (config.consoleExporter) {
    processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  return processors;
}
