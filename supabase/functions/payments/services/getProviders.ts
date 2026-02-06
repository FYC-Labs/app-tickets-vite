/* eslint-disable */
// @ts-nocheck

import { TRANSACTION_PROVIDER } from "npm:@accrupay/node@0.15.1";
import type { GetProvidersResult } from "../types/index.ts";

/** NPM docs: clientSessions.getBaseConfig returns { provider, data: { merchantId, environment } } */
export async function getProviders(
  accruPayClients: { production: any; sandbox: any },
  envTag: string
): Promise<GetProvidersResult> {
  try {
    const defaultEnv = envTag === "prod" ? "production" : "sandbox";
    const accruPay = accruPayClients[defaultEnv] || accruPayClients.sandbox;

    const config = await accruPay.transactions.clientSessions.getBaseConfig({
      transactionProvider: TRANSACTION_PROVIDER.NUVEI,
    });

    return {
      data: [{
        name: 'nuvei',
        config: {
          provider: config.provider,
          ...config.data,
          env: config.data?.environment ?? config.data?.env,
        },
      }],
    };
  } catch (error: any) {
    console.error("Error fetching providers:", error);
    throw new Error(`Failed to fetch providers: ${error.message}`);
  }
}

