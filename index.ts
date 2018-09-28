import 'source-map-support/register';
import * as Express from 'express';
import * as Http from 'http';
import * as Moniker from 'moniker';
import * as SocketIO from 'socket.io';
import * as cLogger from "./logger";
import * as  cid from "cids";


/* eslint-disable */
enum Status {
  OK = 0,
  Error = 1,
}
/* eslint-enable */

function main() {
  const logger = cLogger.newLogger((process.env.APP_NAME) as string)

  const server = new Http.Server(Express);

  server.on('clientError', (err: Error, socket: any) => {
    logger.error({ err }, 'Client error!');
    socket.end('HTTP 400 Bad Request');
  });

  server.listen((process.env.APP_PORT) as string);

  const socket = SocketIO(server);

  // Stores all client hooks.
  const clientHooks: { [clientName: string]: any } = {};

  socket.on('connection', (hook) => {
    logger.info('Client connected');

    let clientName: string;

    hook.emit('connect', {
      status: Status.OK, // eslint-disable-line no-undef
      desc: 'Success',
    });

    // Client configuration
    hook.on('init', (init: any) => {
      logger.info({ init }, 'Initializing client');

      if (clientHooks[init.name]) {
        logger.error('Client name already taken');

        // Client has already been initialized. Emitting error
        hook.emit('init-result', {
          status: Status.Error, // eslint-disable-line no-undef
          desc: 'Already initialized',
          clientName: init.name,
        });
      } else {
        if (init.name) {
          clientName = init.name;
        } else {
          clientName = Moniker.choose();
        }
        // Saves the client name and its hook.
        // Can be used to emit event directly to a connected client
        clientHooks[clientName] = {
          hook, // client hook object
        };

        // Client initialized. Emitting success event!
        hook.emit('init-result', {
          status: Status.OK, // eslint-disable-line no-undef
          desc: 'Initialized',
          clientName: init.name,
        });
        logger.info({ clientName: init.name }, 'Client initialized');
      }
    });

    hook.on('event', (event: any) => {
      const log = logger.child({ cid: cid.newCid() });
      log.info({ event }, 'Event received');

      // If event target is not set,
      // event will be emitted globaly
      if (typeof event.target === 'undefined') {
        socket.emit(event.name, {
          source: clientName,
          ref: event.ref,
          data: event.data,
          mode: 'global',
        });
        log.info('Global event emitted.');
      } else if (typeof clientHooks[event.target] !== 'undefined') {
        clientHooks[event.target].emit(event.name, {
          source: clientName,
          ref: event.ref,
          data: event.data,
          mode: 'direct',
        });
        hook.emit('event-result', {
          status: Status.OK, // eslint-disable-line no-undef
          desc: 'Success',
          ref: event.ref,
        });
        log.info('Direct event emitted');
      } else {
        hook.emit('event-result', {
          status: Status.Error, // eslint-disable-line no-undef
          desc: 'Invalid target ID',
          ref: event.ref,
        });
        log.error('Invalid target ID');
      }
    });
    hook.on('disconnect', () => {
      logger.info('Client disconnected');
      delete clientHooks[clientName]; // Deletes the client from client object
      hook.disconnect(); // Disconnects the socket
    });
  });
}

main();
