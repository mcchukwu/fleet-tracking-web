import type { Geofence } from "../../api/types";

export const geofencesFixture: Geofence[] = [
  {
    "id": "3c4c4066-7ab1-4fb6-878a-0d9c5186698c",
    "name": "Border",
    "kind": "depot",
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.753448486,
            7.938195833
          ],
          [
            3.114624023,
            7.875625027
          ],
          [
            3.063812256,
            7.73548666
          ],
          [
            2.753448486,
            7.938195833
          ]
        ]
      ]
    }
  },
  {
    "id": "00000000-0000-0000-0000-000000000203",
    "name": "Ibadan Customer",
    "kind": "customer",
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            3.87,
            7.36
          ],
          [
            3.9,
            7.36
          ],
          [
            3.9,
            7.385
          ],
          [
            3.87,
            7.385
          ],
          [
            3.87,
            7.36
          ]
        ]
      ]
    }
  },
  {
    "id": "00000000-0000-0000-0000-000000000202",
    "name": "Lekki Depot",
    "kind": "depot",
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            3.47,
            6.43
          ],
          [
            3.49,
            6.43
          ],
          [
            3.49,
            6.445
          ],
          [
            3.47,
            6.445
          ],
          [
            3.47,
            6.43
          ]
        ]
      ]
    }
  },
  {
    "id": "00000000-0000-0000-0000-000000000201",
    "name": "Refinery Gate",
    "kind": "restricted",
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            3.38,
            6.44
          ],
          [
            3.4,
            6.44
          ],
          [
            3.4,
            6.455
          ],
          [
            3.38,
            6.455
          ],
          [
            3.38,
            6.44
          ]
        ]
      ]
    }
  }
];
