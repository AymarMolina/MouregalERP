import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { ProductoInput, RecetaLineaInput, Talla } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { Producto, RecetaLinea } from "./catalogo.types";

@Injectable({ providedIn: "root" })
export class ProductosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/productos`;

  list(): Promise<Producto[]> {
    return firstValueFrom(this.http.get<Producto[]>(this.base));
  }

  get(id: string): Promise<Producto> {
    return firstValueFrom(this.http.get<Producto>(`${this.base}/${id}`));
  }

  create(input: ProductoInput): Promise<Producto> {
    return firstValueFrom(this.http.post<Producto>(this.base, input));
  }

  update(id: string, input: Partial<ProductoInput>): Promise<Producto> {
    return firstValueFrom(this.http.patch<Producto>(`${this.base}/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  getReceta(id: string, talla: Talla): Promise<RecetaLinea[]> {
    return firstValueFrom(this.http.get<RecetaLinea[]>(`${this.base}/${id}/tallas/${talla}/receta`));
  }

  replaceReceta(id: string, talla: Talla, lineas: RecetaLineaInput[]): Promise<RecetaLinea[]> {
    return firstValueFrom(
      this.http.put<RecetaLinea[]>(`${this.base}/${id}/tallas/${talla}/receta`, { lineas }),
    );
  }

  copiarReceta(id: string, talla: Talla, a: Talla[]): Promise<Producto> {
    return firstValueFrom(this.http.post<Producto>(`${this.base}/${id}/tallas/${talla}/copiar-receta`, { a }));
  }

  getFloresPermitidas(id: string): Promise<{ insumoId: string }[]> {
    return firstValueFrom(this.http.get<{ insumoId: string }[]>(`${this.base}/${id}/flores-permitidas`));
  }

  replaceFloresPermitidas(id: string, insumoIds: string[]): Promise<{ insumoId: string }[]> {
    return firstValueFrom(
      this.http.put<{ insumoId: string }[]>(`${this.base}/${id}/flores-permitidas`, { insumoIds }),
    );
  }
}
