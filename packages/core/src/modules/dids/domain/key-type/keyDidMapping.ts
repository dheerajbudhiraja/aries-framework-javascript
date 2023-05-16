import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'
import { AriesFrameworkError } from '../../../../error'
import { isJsonWebKey2020, VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020 } from '../verificationMethod/JsonWebKey2020'

import { keyDidBls12381g1 } from './bls12381g1'
import { keyDidBls12381g1g2 } from './bls12381g1g2'
import { keyDidBls12381g2 } from './bls12381g2'
import { keyDidEd25519 } from './ed25519'
import { keyDidJsonWebKey } from './keyDidJsonWebKey'
import { keyDidX25519 } from './x25519'

export interface KeyDidMapping {
  getVerificationMethods: (did: string, key: Key) => VerificationMethod[]
  getKeyFromVerificationMethod(verificationMethod: VerificationMethod): Key
  supportedVerificationMethodTypes: string[]
}

// TODO: Maybe we should make this dynamically?
const keyDidMapping: Record<KeyType, KeyDidMapping> = {
  [KeyType.Ed25519]: keyDidEd25519,
  [KeyType.X25519]: keyDidX25519,
  [KeyType.Bls12381g1]: keyDidBls12381g1,
  [KeyType.Bls12381g2]: keyDidBls12381g2,
  [KeyType.Bls12381g1g2]: keyDidBls12381g1g2,
  [KeyType.P256]: keyDidJsonWebKey,
  [KeyType.P384]: keyDidJsonWebKey,
  [KeyType.P521]: keyDidJsonWebKey,
}

/**
 * Dynamically creates a mapping from verification method key type to the key Did interface
 * for all key types.
 *
 * {
 *    "Ed25519VerificationKey2018": KeyDidMapping
 * }
 */
const verificationMethodKeyDidMapping = Object.values(KeyType).reduce<Record<string, KeyDidMapping>>(
  (mapping, keyType) => {
    const supported = keyDidMapping[keyType].supportedVerificationMethodTypes.reduce<Record<string, KeyDidMapping>>(
      (accumulator, vMethodKeyType) => ({
        ...accumulator,
        [vMethodKeyType]: keyDidMapping[keyType],
      }),
      {}
    )

    return {
      ...mapping,
      ...supported,
    }
  },
  {}
)

export function getKeyDidMappingByKeyType(keyType: KeyType) {
  const keyDid = keyDidMapping[keyType]

  if (!keyDid) {
    throw new Error(`Unsupported key did from key type '${keyType}'`)
  }

  return keyDid
}

export function getKeyFromVerificationMethod(verificationMethod: VerificationMethod) {
  // This is a special verification method, as it supports basically all key types.
  if (isJsonWebKey2020(verificationMethod)) {
    // TODO: move this validation to another place
    if (!verificationMethod.publicKeyJwk) {
      throw new AriesFrameworkError(
        `Missing publicKeyJwk on verification method with type ${VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020}`
      )
    }

    return Key.fromJwk(verificationMethod.publicKeyJwk)
  }

  const keyDid = verificationMethodKeyDidMapping[verificationMethod.type]
  if (!keyDid) {
    throw new Error(`Unsupported key did from verification method type '${verificationMethod.type}'`)
  }

  return keyDid.getKeyFromVerificationMethod(verificationMethod)
}
