package observability

import (
	"sync/atomic"
)

// Counters provides simple atomic counters for request metrics.
type Counters struct {
	RequestsTotal  atomic.Int64
	RequestsFailed atomic.Int64
}

// GlobalCounters is the application-wide metrics counters.
var GlobalCounters = &Counters{}
