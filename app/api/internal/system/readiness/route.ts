import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { getAdminSession } from "@/lib/auth"
import { countIncompletePaidGroupOrders } from "@/lib/payments/group-order-reconciliation"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type VariableRow = {
  variableName: string
  value: string
}

type StatusRow = {
  variableName: string
  value: string
}

function databaseUrlSettings() {
  const raw = String(process.env.DATABASE_URL || "")
  if (!raw) return { configured: false, connectionLimit: null, poolTimeout: null, connectTimeout: null }
  try {
    const url = new URL(raw)
    return {
      configured: true,
      connectionLimit: url.searchParams.get("connection_limit"),
      poolTimeout: url.searchParams.get("pool_timeout"),
      connectTimeout: url.searchParams.get("connect_timeout")
    }
  } catch {
    return { configured: true, connectionLimit: null, poolTimeout: null, connectTimeout: null }
  }
}

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ ok: false, error: "Owner access is required." }, { status: 403 })

  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const [variables, status, indexes, incompletePaidGroupOrders] = await Promise.all([
      prisma.$queryRaw<VariableRow[]>(Prisma.sql`
        SELECT VARIABLE_NAME AS variableName, VARIABLE_VALUE AS value
        FROM performance_schema.global_variables
        WHERE VARIABLE_NAME IN ('max_connections', 'innodb_buffer_pool_size', 'wait_timeout')
      `),
      prisma.$queryRaw<StatusRow[]>(Prisma.sql`
        SELECT VARIABLE_NAME AS variableName, VARIABLE_VALUE AS value
        FROM performance_schema.global_status
        WHERE VARIABLE_NAME IN ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Aborted_connects')
      `),
      prisma.$queryRaw<Array<{ tableName: string; indexName: string }>>(Prisma.sql`
        SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            (TABLE_NAME = 'course_orders' AND INDEX_NAME = 'idx_course_orders_student_access')
            OR (TABLE_NAME = 'course_manual_payments' AND INDEX_NAME = 'idx_manual_payments_student_access')
            OR (TABLE_NAME = 'family_children' AND INDEX_NAME = 'idx_family_child_account_status')
          )
      `),
      countIncompletePaidGroupOrders(5)
    ])
    const variableMap = Object.fromEntries(variables.map((row) => [row.variableName.toLowerCase(), row.value]))
    const statusMap = Object.fromEntries(status.map((row) => [row.variableName.toLowerCase(), row.value]))
    const urlSettings = databaseUrlSettings()
    const maxConnections = Number(variableMap.max_connections || 0)
    const maxUsedConnections = Number(statusMap.max_used_connections || 0)
    const warnings: string[] = []
    if (!urlSettings.connectionLimit) warnings.push("DATABASE_URL does not set connection_limit.")
    if (!urlSettings.poolTimeout) warnings.push("DATABASE_URL does not set pool_timeout.")
    if (!urlSettings.connectTimeout) warnings.push("DATABASE_URL does not set connect_timeout.")
    if (maxConnections > 0 && maxUsedConnections / maxConnections >= 0.7) {
      warnings.push("Peak database connections have used at least 70% of the configured limit.")
    }
    if (Number(variableMap.innodb_buffer_pool_size || 0) < 1024 * 1024 * 1024) {
      warnings.push("The InnoDB buffer pool is below the recommended 1 GB production baseline.")
    }
    if (indexes.length < 3) warnings.push("The student scale-readiness migration has not been fully applied.")
    if (incompletePaidGroupOrders > 0) {
      warnings.push(`${incompletePaidGroupOrders} paid group order${incompletePaidGroupOrders === 1 ? " is" : "s are"} awaiting seat or learner provisioning.`)
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      database: {
        maxConnections,
        threadsConnected: Number(statusMap.threads_connected || 0),
        threadsRunning: Number(statusMap.threads_running || 0),
        maxUsedConnections,
        abortedConnects: Number(statusMap.aborted_connects || 0),
        innodbBufferPoolBytes: Number(variableMap.innodb_buffer_pool_size || 0),
        waitTimeoutSeconds: Number(variableMap.wait_timeout || 0)
      },
      applicationPool: urlSettings,
      groupOrderProvisioning: {
        incompletePaidOrders: incompletePaidGroupOrders,
        healthy: incompletePaidGroupOrders === 0
      },
      requiredIndexesPresent: indexes.map((row) => `${row.tableName}.${row.indexName}`),
      warnings
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Database readiness check failed."
      },
      { status: 503 }
    )
  }
}
