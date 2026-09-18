import { describe, expect, it, vi } from "vitest";

import { memoriserGetUser } from "./memo-get-user";

const ok = { data: { user: { id: "u1" } }, error: null };
const vide = { data: { user: null }, error: null };

describe("memoriserGetUser", () => {
  it("un seul aller-retour pour plusieurs actions de la même requête", async () => {
    const original = vi.fn(async () => ok);
    const getUser = memoriserGetUser(original);
    const [a, b, c] = await Promise.all([getUser(), getUser(), getUser()]);
    expect(original).toHaveBeenCalledTimes(1);
    expect(a).toBe(ok);
    expect(b).toBe(ok);
    expect(c).toBe(ok);
  });

  it("une réponse sans utilisateur n'est pas mémorisée", async () => {
    const original = vi.fn().mockResolvedValueOnce(vide).mockResolvedValueOnce(ok);
    const getUser = memoriserGetUser(original);
    expect((await getUser()).data.user).toBeNull();
    expect((await getUser()).data.user).toEqual({ id: "u1" });
    expect(original).toHaveBeenCalledTimes(2);
  });

  it("une erreur réseau n'est pas mémorisée", async () => {
    const original = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValueOnce(ok);
    const getUser = memoriserGetUser(original);
    await expect(getUser()).rejects.toThrow("réseau");
    expect((await getUser()).data.user).toEqual({ id: "u1" });
  });

  it("un JWT explicite contourne le partage", async () => {
    const original = vi.fn(async () => ok);
    const getUser = memoriserGetUser(original);
    await getUser("jwt-a");
    await getUser("jwt-b");
    await getUser();
    expect(original).toHaveBeenCalledTimes(3);
    expect(original).toHaveBeenNthCalledWith(1, "jwt-a");
  });
});
