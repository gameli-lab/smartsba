'use server'

import { normalizePhoneToE164 } from '@/lib/phone'

const HUBTEL_OTP_BASE_URL = 'https://api-otp.hubtel.com/otp'

interface HubtelSendOtpResponse {
  message: string
  code: string
  data: {
    requestId: string
    prefix: string
  }
}

interface HubtelResendOtpResponse {
  message: string
  code: string
  data: {
    requestId: string
    prefix: string
  }
}

interface HubtelOtpResult<T> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
}

function getHubtelCredentials(): { apiKey: string; senderId: string; countryCode: string } {
  const apiKey = process.env.HUBTEL_OTP_API_KEY
  const senderId = process.env.HUBTEL_OTP_SENDER_ID
  const countryCode = process.env.HUBTEL_OTP_COUNTRY_CODE || 'GH'

  if (!apiKey) {
    throw new Error('HUBTEL_OTP_API_KEY is not configured')
  }

  if (!senderId) {
    throw new Error('HUBTEL_OTP_SENDER_ID is not configured')
  }

  return { apiKey, senderId, countryCode }
}

/**
 * Send an OTP via Hubtel.
 * POST /otp/send
 */
export async function sendHubtelOtp(
  phoneNumber: string,
  senderIdOverride?: string
): Promise<HubtelOtpResult<HubtelSendOtpResponse['data']>> {
  try {
    const { apiKey, senderId, countryCode } = getHubtelCredentials()
    const normalizedPhone = normalizePhoneToE164(phoneNumber, countryCode)

    const response = await fetch(`${HUBTEL_OTP_BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        senderId: senderIdOverride || senderId,
        phoneNumber: normalizedPhone,
        countryCode,
      }),
    })

    const payload = (await response.json().catch(() => null)) as HubtelSendOtpResponse | null

    if (!response.ok) {
      return {
        success: false,
        error: payload?.message || `Hubtel OTP send failed with status ${response.status}`,
        statusCode: response.status,
      }
    }

    if (!payload?.data?.requestId || !payload?.data?.prefix) {
      return {
        success: false,
        error: 'Hubtel OTP response missing requestId or prefix',
        statusCode: response.status,
      }
    }

    return {
      success: true,
      data: {
        requestId: payload.data.requestId,
        prefix: payload.data.prefix,
      },
      statusCode: response.status,
    }
  } catch (err) {
    console.error('Hubtel OTP send exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send OTP via Hubtel',
    }
  }
}

/**
 * Verify an OTP via Hubtel.
 * POST /otp/verify
 * Note: No response payload. Listen for HTTP status code.
 */
export async function verifyHubtelOtp(
  requestId: string,
  prefix: string,
  code: string
): Promise<HubtelOtpResult<null>> {
  try {
    const { apiKey } = getHubtelCredentials()

    const response = await fetch(`${HUBTEL_OTP_BASE_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        requestId,
        prefix,
        code,
      }),
    })

    if (!response.ok) {
      let errorMessage = `Hubtel OTP verification failed with status ${response.status}`
      const payload = (await response.json().catch(() => null)) as { message?: string; code?: string } | null
      if (payload?.message) {
        errorMessage = payload.message
      } else if (response.status === 2001) {
        errorMessage = 'OTP session may have expired. Please request a new code.'
      }
      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
      }
    }

    return {
      success: true,
      data: null,
      statusCode: response.status,
    }
  } catch (err) {
    console.error('Hubtel OTP verify exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to verify OTP via Hubtel',
    }
  }
}

/**
 * Resend a previously issued OTP via Hubtel.
 * POST /otp/resend
 */
export async function resendHubtelOtp(
  requestId: string
): Promise<HubtelOtpResult<HubtelResendOtpResponse['data']>> {
  try {
    const { apiKey } = getHubtelCredentials()

    const response = await fetch(`${HUBTEL_OTP_BASE_URL}/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        requestId,
      }),
    })

    const payload = (await response.json().catch(() => null)) as HubtelResendOtpResponse | null

    if (!response.ok) {
      return {
        success: false,
        error: payload?.message || `Hubtel OTP resend failed with status ${response.status}`,
        statusCode: response.status,
      }
    }

    return {
      success: true,
      data: payload?.data,
      statusCode: response.status,
    }
  } catch (err) {
    console.error('Hubtel OTP resend exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resend OTP via Hubtel',
    }
  }
}