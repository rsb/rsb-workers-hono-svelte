// Generated from prd/todo/api.md by tooling/api-spec/generate.ts. Do not edit: change the spec and regenerate.
import type { EndpointKey } from "./endpoints.ts";

/**
 * A worked example: the request as sent, with its path parameters read
 * out, and the reply's status and whole envelope. The examples every
 * endpoint shares have no request.
 */
export type Example = {
  name: string;
  request?: {
    method: string;
    path: string;
    params: Record<string, string>;
    query: [string, string][];
    body?: unknown;
  };
  status: number;
  reply: unknown;
};

/** The examples every endpoint shares: failures any request can meet. */
export const everyExamples: Example[] = [
  {
    "name": "a body over the limit",
    "status": 413,
    "reply": {
      "ok": false,
      "error": {
        "kind": "too_large",
        "message": "request body too large"
      }
    }
  },
  {
    "name": "a bearer token that names no session",
    "status": 401,
    "reply": {
      "ok": false,
      "error": {
        "kind": "unauthenticated",
        "message": "the bearer token names no live session"
      }
    }
  },
  {
    "name": "a change from another site, with the session cookie",
    "status": 403,
    "reply": {
      "ok": false,
      "error": {
        "kind": "forbidden",
        "message": "the request does not come from the BFF's page",
        "reason": "channel"
      }
    }
  },
  {
    "name": "the server fails",
    "status": 500,
    "reply": {
      "ok": false,
      "error": {
        "kind": "internal",
        "message": "internal error"
      }
    }
  }
];

/** Each endpoint's examples, keyed as `endpoints` is. */
export const examples: Record<EndpointKey, Example[]> = {
  "GET /health": [
    {
      "name": "the api is up",
      "request": {
        "method": "GET",
        "path": "/health",
        "params": {},
        "query": []
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": {
          "ok": true
        }
      }
    }
  ],
  "GET /todos": [
    {
      "name": "lists every todo",
      "request": {
        "method": "GET",
        "path": "/todos",
        "params": {},
        "query": []
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": [
          {
            "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
            "title": "Buy milk",
            "completed": false
          },
          {
            "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
            "title": "Post the letter",
            "completed": true
          }
        ]
      }
    },
    {
      "name": "lists the completed todos",
      "request": {
        "method": "GET",
        "path": "/todos",
        "params": {},
        "query": [
          [
            "completed",
            "true"
          ]
        ]
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": [
          {
            "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
            "title": "Post the letter",
            "completed": true
          }
        ]
      }
    },
    {
      "name": "completed is not true or false",
      "request": {
        "method": "GET",
        "path": "/todos",
        "params": {},
        "query": [
          [
            "completed",
            "yes"
          ]
        ]
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "completed must be true or false",
          "field": "completed"
        }
      }
    },
    {
      "name": "completed is given twice",
      "request": {
        "method": "GET",
        "path": "/todos",
        "params": {},
        "query": [
          [
            "completed",
            "true"
          ],
          [
            "completed",
            "false"
          ]
        ]
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "completed must be given once",
          "field": "completed"
        }
      }
    }
  ],
  "GET /todos/counts": [
    {
      "name": "counts the todos",
      "request": {
        "method": "GET",
        "path": "/todos/counts",
        "params": {},
        "query": []
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": {
          "active": 1,
          "completed": 1
        }
      }
    }
  ],
  "POST /todos": [
    {
      "name": "adds a todo",
      "request": {
        "method": "POST",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "title": "Buy milk"
        }
      },
      "status": 201,
      "reply": {
        "ok": true,
        "data": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
          "title": "Buy milk",
          "completed": false
        }
      }
    },
    {
      "name": "the title is not text",
      "request": {
        "method": "POST",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "title": 3
        }
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "title must be text",
          "field": "title"
        }
      }
    },
    {
      "name": "the title is empty",
      "request": {
        "method": "POST",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "title": ""
        }
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "title is empty",
          "field": "title"
        }
      }
    },
    {
      "name": "the list is full",
      "request": {
        "method": "POST",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "title": "Buy milk"
        }
      },
      "status": 409,
      "reply": {
        "ok": false,
        "error": {
          "kind": "limit",
          "message": "the list is full"
        }
      }
    }
  ],
  "PATCH /todos": [
    {
      "name": "marks every todo completed",
      "request": {
        "method": "PATCH",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "completed": true
        }
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": [
          {
            "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
            "title": "Buy milk",
            "completed": true
          },
          {
            "id": "5d2a9c7e-1f3b-4e8a-b6d4-7c9e0a1f2b3c",
            "title": "Post the letter",
            "completed": true
          }
        ]
      }
    },
    {
      "name": "completed is not a boolean",
      "request": {
        "method": "PATCH",
        "path": "/todos",
        "params": {},
        "query": [],
        "body": {
          "completed": "yes"
        }
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "completed must be true or false",
          "field": "completed"
        }
      }
    }
  ],
  "PATCH /todos/{id}": [
    {
      "name": "renames a todo",
      "request": {
        "method": "PATCH",
        "path": "/todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
        "params": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90"
        },
        "query": [],
        "body": {
          "title": "Buy oat milk"
        }
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
          "title": "Buy oat milk",
          "completed": false
        }
      }
    },
    {
      "name": "the body is empty",
      "request": {
        "method": "PATCH",
        "path": "/todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
        "params": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90"
        },
        "query": [],
        "body": {}
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "body must have title, completed or both",
          "field": "body"
        }
      }
    },
    {
      "name": "no todo has the id",
      "request": {
        "method": "PATCH",
        "path": "/todos/missing",
        "params": {
          "id": "missing"
        },
        "query": [],
        "body": {
          "completed": true
        }
      },
      "status": 404,
      "reply": {
        "ok": false,
        "error": {
          "kind": "not_found",
          "message": "no todo has id missing"
        }
      }
    }
  ],
  "DELETE /todos": [
    {
      "name": "clears the completed todos",
      "request": {
        "method": "DELETE",
        "path": "/todos",
        "params": {},
        "query": [
          [
            "completed",
            "true"
          ]
        ]
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": [
          {
            "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
            "title": "Buy milk",
            "completed": false
          }
        ]
      }
    },
    {
      "name": "completed is not true",
      "request": {
        "method": "DELETE",
        "path": "/todos",
        "params": {},
        "query": [
          [
            "completed",
            "false"
          ]
        ]
      },
      "status": 422,
      "reply": {
        "ok": false,
        "error": {
          "kind": "validation",
          "message": "completed must be true",
          "field": "completed"
        }
      }
    }
  ],
  "DELETE /todos/{id}": [
    {
      "name": "removes a todo",
      "request": {
        "method": "DELETE",
        "path": "/todos/0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90",
        "params": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90"
        },
        "query": []
      },
      "status": 200,
      "reply": {
        "ok": true,
        "data": {
          "id": "0b6f4c1e-8a7d-4b51-9e0a-3c2d1f5e7a90"
        }
      }
    },
    {
      "name": "no todo has the id",
      "request": {
        "method": "DELETE",
        "path": "/todos/missing",
        "params": {
          "id": "missing"
        },
        "query": []
      },
      "status": 404,
      "reply": {
        "ok": false,
        "error": {
          "kind": "not_found",
          "message": "no todo has id missing"
        }
      }
    }
  ],
};
