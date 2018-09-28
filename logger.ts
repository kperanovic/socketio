import * as Pino from "pino";

function errorSerializer(err: Error): object {
    return {
        code: (err as any).code,
        message: err.message,
        stack: err.stack,
    };
}

export function newLogger(name: string): Pino.Logger {
    const pretty = Pino.pretty();
    pretty.pipe(process.stdout);
    return Pino({
        name,
        serializers: {
            err: errorSerializer,
        },
    }, pretty);
}