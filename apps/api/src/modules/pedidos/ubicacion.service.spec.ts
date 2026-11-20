import { BadRequestException } from '@nestjs/common';
import { UbicacionService } from './ubicacion.service';

const redir = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

describe('UbicacionService', () => {
  const svc = new UbicacionService();
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('lee un link largo sin salir a la red', async () => {
    global.fetch = jest.fn();
    await expect(
      svc.resolver('https://maps.google.com/?q=-12.07,-77.04'),
    ).resolves.toEqual({ lat: -12.07, lng: -77.04 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sigue la redirección de un link corto', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        redir('https://www.google.com/maps/place/X/@-12.1,-77.0,17z'),
      );
    await expect(
      svc.resolver('https://maps.app.goo.gl/Abc123'),
    ).resolves.toEqual({ lat: -12.1, lng: -77.0 });
  });

  it('no sigue redirecciones fuera de Google', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(redir('http://169.254.169.254/latest'));
    await expect(
      svc.resolver('https://maps.app.goo.gl/Abc123'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza hosts ajenos sin pedirlos', async () => {
    global.fetch = jest.fn();
    await expect(
      svc.resolver('https://ejemplo.com/maps?q=-12,-77'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
